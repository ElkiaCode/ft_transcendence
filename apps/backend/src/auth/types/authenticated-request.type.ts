import { Request } from 'express';
import { JwtPayload } from './jwt-payload.type'; // Import your existing payload type

export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}
