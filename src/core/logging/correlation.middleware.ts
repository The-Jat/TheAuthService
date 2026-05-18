import {
  Injectable,
  NestMiddleware,
} from '@nestjs/common';

import {
  Request,
  Response,
  NextFunction,
} from 'express';

import { randomUUID }
from 'crypto';

@Injectable()
export class CorrelationMiddleware
  implements NestMiddleware {

  use(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {

    /*
      If request already has ID
      use it.

      Otherwise create one.
    */

    const correlationId =
      req.headers[
        'x-correlation-id'
      ] as string
      ||
      randomUUID();

    /*
      Attach to request
    */

    req['correlationId'] =
      correlationId;

    /*
      Send back in response
    */

    res.setHeader(
      'x-correlation-id',
      correlationId,
    );

    next();
  }
}