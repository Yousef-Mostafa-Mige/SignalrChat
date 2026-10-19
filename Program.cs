
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Scalar.AspNetCore;
using SignalRChat.Data;
using SignalRChat.Services;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllers();
builder.Services.AddScoped<IAddGroup, AddGroup>();
builder.Services.AddSignalR();
builder.Services.AddScoped<IUser, Userservices>();
builder.Services.AddAuthentication(
    JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters =
            new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,

                ValidIssuer =
                    builder.Configuration["AppSettings:Issuer"],

                ValidAudience =
                    builder.Configuration["AppSettings:Audience"],

                IssuerSigningKey =
                    new SymmetricSecurityKey(
                        Encoding.UTF8.GetBytes(
                            builder.Configuration[
                                "AppSettings:SecretKey"]!
                        )
                    )
            };
    });
builder.Services.AddDbContext<AppDbContext>(Option =>
Option.UseMySQL(
        builder.Configuration.GetConnectionString(
            "DefaultConnection")!
    ));
builder.Services.AddOpenApi();
var app = builder.Build();

app.UseDefaultFiles();
app.UseStaticFiles();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference();
}
app.UseAuthentication();
app.UseAuthorization();
app.MapHub<ChatHub>("/chat");

app.MapControllers();

app.Run();
