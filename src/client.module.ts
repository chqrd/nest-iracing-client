import { DynamicModule, Global, ModuleMetadata } from "@nestjs/common";
import { ClientService } from "./client.service";

export interface ClientModuleOptions {
  readonly redisUrl: string;
}

export interface ClientModuleAsyncOptions extends Pick<ModuleMetadata, "imports"> {
  useFactory: (...args: any[]) => Promise<ClientModuleOptions>;
  inject?: any[];
}

@Global()
export class ClientModule {
  static register(options: ClientModuleOptions): DynamicModule {
    const providers = [
      {
        provide: "CLIENT_OPTIONS",
        useValue: options,
      },
      ClientService,
    ];

    return { providers, exports: providers, module: ClientModule };
  }

  static registerAsync(options: ClientModuleAsyncOptions): DynamicModule {
    const providers = [
      {
        provide: "CLIENT_OPTIONS",
        useFactory: options.useFactory,
        inject: options.inject || [],
      },
      ClientService,
    ];

    return {
      module: ClientModule,
      imports: options.imports,
      providers,
      exports: [ClientService],
    };
  }
}
