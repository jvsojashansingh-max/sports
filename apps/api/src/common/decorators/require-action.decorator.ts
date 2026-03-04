import { SetMetadata } from '@nestjs/common';
import type { Action } from '../policy/can';

export const REQUIRED_ACTION_KEY = 'requiredAction';

export const RequireAction = (action: Action) => SetMetadata(REQUIRED_ACTION_KEY, action);
