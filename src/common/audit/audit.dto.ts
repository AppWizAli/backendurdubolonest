import { IsIn, IsOptional, IsString, Length } from 'class-validator';
import { PageQueryDto } from '../pagination/page.dto';

export class AuditListDto extends PageQueryDto {
  @IsOptional() @IsString() @Length(1, 120) search?: string;
  @IsOptional() @IsIn(['SUCCESS', 'DENIED', 'ERROR']) outcome?: string;
}
