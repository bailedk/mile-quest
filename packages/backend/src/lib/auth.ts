// Authentication utilities
import { APIGatewayProxyEvent } from 'aws-lambda';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-client';
import { ApiError } from '@mile-quest/shared';

const client = jwksClient({
  jwksUri: `https://cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.USER_POOL_ID}/.well-known/jwks.json`
});

interface JWTPayload {
  sub: string;
  email: string;
  email_verified: boolean;
  'cognito:username': string;
  aud: string;
  exp: number;
  iat: number;
}

function getKey(header: any, callback: any) {
  client.getSigningKey(header.kid, (err, key) => {
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}

export async function verifyToken(token: string): Promise<JWTPayload> {
  return new Promise((resolve, reject) => {
    jwt.verify(token, getKey, {
      audience: process.env.USER_POOL_CLIENT_ID,
      issuer: `https://cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.USER_POOL_ID}`,
      algorithms: ['RS256']
    }, (err, decoded) => {
      if (err) {
        reject(new ApiError(401, 'Invalid token'));
      } else {
        resolve(decoded as JWTPayload);
      }
    });
  });
}

export async function getUserFromEvent(event: APIGatewayProxyEvent): Promise<JWTPayload> {
  const authHeader = event.headers.Authorization || event.headers.authorization;
  
  if (!authHeader) {
    throw new ApiError(401, 'Missing authorization header');
  }

  const token = authHeader.replace('Bearer ', '');
  return await verifyToken(token);
}

export function createAuthResponse(statusCode: number, body: any) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
      'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    },
    body: JSON.stringify(body),
  };
}