import { Request } from 'express';
import { TokenPayload } from '../utils/jwt.util';

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}
