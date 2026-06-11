import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const type = context.getType();

    const handlerName = context.getHandler().name;
    const className = context.getClass().name;

    let requestData: unknown;

    if (type === 'http') {
      const request = context.switchToHttp().getRequest() as Request;

      requestData = {
        method: request.method,
        url: request.url,
        params: request.params,
        query: request.query,
        body: request.body,
      };
    } else if (type === 'ws') {
      const ws = context.switchToWs();

      const client = ws.getClient();
      const data = ws.getData();

      requestData = {
        socketId: client?.id,
        event: context.getHandler().name,
        data,
      };
    } else {
      requestData = 'Unknown context';
    }

    this.logger.debug(
      `[${type}] ${className}.${handlerName} <- ${JSON.stringify(requestData)}`,
    );

    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        next: (response) => {
          this.logger.debug(
            `[${type}] ${className}.${handlerName} -> ${JSON.stringify(response)} (${Date.now() - startedAt}ms)`,
          );
        },
        error: (error) => {
          this.logger.error(
            `[${type}] ${className}.${handlerName} ERROR (${Date.now() - startedAt}ms)`,
            error?.stack,
          );
        },
      }),
    );
  }
}
