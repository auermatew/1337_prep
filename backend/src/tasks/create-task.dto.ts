import { Transform } from 'class-transformer';
import { IsInt, IsString, Length, Max, Min } from 'class-validator';

export class CreateTaskDto {
  // Non-strings pass through untouched so @IsString rejects them with 400.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 100)
  name: string;

  @IsInt()
  @Min(1)
  @Max(86400)
  durationSeconds: number;
}
