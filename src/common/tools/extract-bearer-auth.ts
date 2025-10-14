import {Request} from "express";
import {UnauthorizedException} from "@nestjs/common";

export function extractBearerToken(request: Request): string {
    const headerValue = request.headers['authorization'] || request.headers['Authorization'];

    if (Array.isArray(headerValue)) {
        throw new UnauthorizedException('Authorization token header must be a single value');
    }

    if (typeof headerValue !== 'string' || headerValue.trim().length === 0) {
        throw new UnauthorizedException('Authorization token header missing');
    }

    const [scheme, token] = headerValue.trim().split(/\s+/);
    if (!/^Bearer$/i.test(scheme) || !token) {
        throw new UnauthorizedException('Invalid authorization header format');
    }

    return token.trim();
}