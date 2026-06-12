import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

type SocketClient = {
  id?: string;
};

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const type = context.getType();
    const handlerName = context.getHandler().name;
    const className = context.getClass().name;
    let requestData: unknown;

    if (type === 'http') {
      const request = context.switchToHttp().getRequest<{
        method?: string;
        path?: string;
        url?: string;
      }>();

      requestData = {
        method: request.method,
        path: request.path ?? request.url?.split('?')[0],
      };
    } else if (type === 'ws') {
      const client = context.switchToWs().getClient<SocketClient>();

      requestData = {
        socketId: client.id,
        event: context.getHandler().name,
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
        next: () => {
          this.logger.debug(
            `[${type}] ${className}.${handlerName} -> completed (${Date.now() - startedAt}ms)`,
          );
        },
        error: (error: unknown) => {
          const errorDetails =
            error instanceof Error
              ? `${error.name}: ${error.message}`
              : 'Unknown error';

          this.logger.error(
            `[${type}] ${className}.${handlerName} ERROR (${Date.now() - startedAt}ms): ${errorDetails}`,
          );
        },
      }),
    );
  }
}
