import { Inject, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from "@nestjs/common";
import axios, { AxiosInstance } from "axios";
import { wrapper } from "axios-cookiejar-support";
import { createHash, randomInt } from "crypto";
import { addHours, addMinutes, differenceInSeconds } from "date-fns";
import { RedisClientType, createClient } from "redis";
import { CookieJar } from "tough-cookie";
import { ClientModuleOptions } from "./client.module";

export interface Client {
  readonly axios: AxiosInstance;
  readonly email: string;
  readonly expires: Date;
}

export interface Account {
  readonly email: string;
  readonly password: string;
}

@Injectable()
export class ClientService implements OnApplicationBootstrap, OnApplicationShutdown {
  private logger = new Logger(ClientService.name);

  private readonly redis: RedisClientType = createClient({ url: this.options.redisUrl });

  constructor(@Inject("CLIENT_OPTIONS") private readonly options: ClientModuleOptions) {}

  async onApplicationBootstrap() {
    await this.redis.connect();
  }

  async onApplicationShutdown() {
    await this.redis.disconnect();
  }

  private hashPassword(email: string, password: string): string {
    return createHash("sha256")
      .update(password + email.toLowerCase())
      .digest("base64");
  }

  public async login(account: Account) {
    const { email, password } = account;
    const failedLogin = await this.hasFailedLogin(email);

    if (failedLogin) {
      this.logger.error(`Failed login attempt for ${email} detected!`);
      return;
    }

    const jar = new CookieJar();
    const axiosClient = wrapper(axios.create({ jar }));
    const payload = { email, password: this.hashPassword(email, password) };
    const baseURL = "https://members-ng.iracing.com";

    const response = await axiosClient.post("/auth", payload, { baseURL });

    const { authcode, message } = response.data;

    if (authcode == 0) {
      await this.storeFailedLogin(email, message);
    } else {
      await this.storeClient(email, jar);
    }

    this.logger.log(`Login attempt for ${email} was ${authcode == 0 ? "unsuccessful" : "successful"}`);
  }

  public async loadClient(email?: string): Promise<Client | null> {
    const accounts = await this.redis.keys("accounts:*");
    const client = email ? await this.redis.get(`accounts:${email}`) : await this.redis.get(accounts[randomInt(0, accounts.length)]);

    if (!client) {
      return null;
    }

    const json = JSON.parse(Buffer.from(client, "base64").toString("utf-8"));
    const jar = CookieJar.fromJSON(json.jar);

    return {
      axios: wrapper(axios.create({ jar })),
      email: json.email,
      expires: new Date(json.expires),
    };
  }

  public async hasFailedLogin(email: string): Promise<boolean> {
    const data = await this.redis.get(`failed:${email}`);

    return data !== null;
  }

  public async storeFailedLogin(email: string, message: string) {
    const expires = addHours(new Date(), 24);
    const ttl = differenceInSeconds(expires, new Date());

    const key = `failed:${email}`;
    const payload = JSON.stringify({ failedAt: new Date(), message });

    this.logger.error(`Store failed login attempt for ${email}`);

    await this.redis.set(key, payload, { EX: ttl });
  }

  public async storeClient(email: string, jar: CookieJar) {
    const expires = addMinutes(new Date(), 40);
    const ttl = differenceInSeconds(expires, new Date());

    const key = `accounts:${email}`;
    const payload = Buffer.from(JSON.stringify({ email, expires, jar })).toString("base64");

    await this.redis.set(key, payload, { EX: ttl });
  }
}
