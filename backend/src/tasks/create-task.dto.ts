import { Transform } from 'class-transformer';
import { IsInt, IsString, Length, Matches, Max, Min } from 'class-validator';

export class CreateTaskDto {
  // Non-strings pass through untouched so @IsString rejects them with 400.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 100)
  // U+0000 is the one character Postgres text cannot store.
  // oxlint-disable-next-line no-control-regex
  @Matches(/^[^\u0000]*$/, { message: 'name must not contain NUL characters' })
  name: string;

  @IsInt()
  @Min(1)
  @Max(86400)
  durationSeconds: number;
}
