import { SetMetadata } from '@nestjs/common';

// Marks a route as reachable without a session (login page endpoints).
export const IS_PUBLIC = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);
