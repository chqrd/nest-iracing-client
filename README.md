# nest-iracing-client

This NestJS module adds an iRacing API client to your project.

## Installation

```typescript
import { ClientModule } from "@chqrd/nest-iracing-client";
import { Module } from "@nestjs/common";

@Module({
  imports: [
    ClientModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config) => ({ redisUrl: config.getOrThrow("REDIS_URL", "redis://localhost:6379") }),
    }),
  ],
})
export class AppModule {}
```

```typescript
@Injectable()
export class RequestService {
  constructor(private readonly client: ClientService) {}

  async doSomethingWithTheClient() {
    const client = await this.client.loadClient("myiracingaccount@example.com");
  }
}
```

### Project setup

```bash
$ npm install
```

### Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```
