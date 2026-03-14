import {Request} from "express";
import {UnauthorizedException} from "@nestjs/common";

export function extractAuthToken(request: Request): string {
  const cookie = request.cookies?.['auth_token'];
  if (cookie) return cookie;

  const authorization = request.headers['authorization'];
  if (authorization && authorization.startsWith('Bearer ')) {
    return authorization.slice(7);
  }

  throw new UnauthorizedException('Missing or invalid Cookie or Authorization header');
}