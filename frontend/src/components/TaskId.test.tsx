import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TaskId } from './TaskId';

const ID = '3f2a1b9c-4d5e-4f60-8a7b-1c2d3e4f5a6b';

afterEach(cleanup);

describe('TaskId', () => {
  it('shows the first 8 characters with the full id on hover', () => {
    render(<TaskId id={ID} />);
    const label = screen.getByText('3f2a1b9c');
    expect(label.getAttribute('title')).toBe(ID);
  });

  it('is plain text, not a button', () => {
    render(<TaskId id={ID} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
