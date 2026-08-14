import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import express from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ limit: '50mb', extended: true }));

    // All API routes live under /api so the built frontend (served same-origin
    // by ServeStaticModule) calls same-origin paths and won't collide with
    // static files. A global SessionGuard protects every /api route except the
    // @Public() login endpoints; the SPA shell itself is public and shows the
    // login page when /api/auth/me returns 401.
    app.setGlobalPrefix('api');

    // Same-origin in production; this only matters for split local dev.
    app.enableCors({ origin: 'http://localhost:3000', credentials: true });

    // Loopback only — the public tunnel connects here; the port is never
    // published on the box.
    await app.listen(3001, '127.0.0.1');
    console.log('🚀 Finance Tracker Backend running on http://127.0.0.1:3001');
}

bootstrap();
