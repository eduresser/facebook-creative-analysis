import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FacebookModule } from './facebook/facebook.module';

@Module({
  imports: [FacebookModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
