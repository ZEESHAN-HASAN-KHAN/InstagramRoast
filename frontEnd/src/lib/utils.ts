import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { SignJWT } from 'jose';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// create a jwt token with expiration of 1 minute using VITE_APP_TOKEN_SECRET
export async function createToken() {
  const secret = new TextEncoder().encode(import.meta.env.VITE_APP_TOKEN_SECRET); // Encode secret
  const expirationTime = 20; // Expiration time in seconds

  const jwt = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' }) // Set the algorithm for signing
    .setExpirationTime(Math.floor(Date.now() / 1000) + expirationTime) // Set expiration in seconds
    .sign(secret); // Sign the JWT with the secret

  return jwt;
}
