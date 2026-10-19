using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using SignalRChat.Middleware;

namespace SignalRChat.Middleware
{
    public class GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger) : IExceptionHandler
    {
        public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
        {

            logger.LogError(exception, "An unhandled exception occurred.");
            var (statusCode, message) = exception switch
            {
                NotFoundException => (StatusCodes.Status404NotFound, "not found"),
                ConflictException => (StatusCodes.Status409Conflict, "Internal Server Error"),
                BadRequestException => (StatusCodes.Status400BadRequest, "bad request"),
                UnauthorizedException => (StatusCodes.Status401Unauthorized, "unauthorized"),
                NullReferenceException => (StatusCodes.Status400BadRequest, "null reference"),
                _ => (StatusCodes.Status500InternalServerError, "An unexpected error occurred.")
            };
            httpContext.Response.StatusCode = statusCode;
            var error = new ProblemDetails
            {
                Status = statusCode,
                Title = message,
                Detail = exception.Message
            };
            await httpContext.Response.WriteAsJsonAsync(error, cancellationToken);
            return true;
        }
    }
}