import { Module } from '@nestjs/common';
import { DramasController } from './dramas.controller';
import { DramasService } from './dramas.service';
@Module({ controllers: [DramasController], providers: [DramasService], exports: [DramasService] })
export class DramasModule {}
