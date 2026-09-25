import { IsOptional, IsString, Length } from 'class-validator';

export class CreatePostDto {
  @IsString()
  @Length(1, 200)
  title: string;

  @IsString()
  body: string;

  @IsOptional()
  @IsString()
  excerpt?: string;
}
