using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using SignalRChat.Data;
using SignalRChat.Dtos;
using SignalRChat.Dtos.Token;
using SignalRChat.Dtos.UserDto;
using SignalRChat.Entities;
using SignalRChat.Middleware;

namespace SignalRChat.Services
{
    public class Userservices(AppDbContext context, IConfiguration configuration) : IUser
    {
        public async Task<UserResponseDto> register(CreateUserRequestDto request)
        {
            // 1. التأكد إن اسم المستخدم مش متسجل قبل كده
            var existingUser = await context.users.FirstOrDefaultAsync(p => p.Name == request.Name);
            if (existingUser is not null)
            {
                throw new BadRequestException("Username already exists.");
            }

            // 2. إنشاء كائن المستخدم الجديد
            var newUser = new User
            {
                Name = request.Name,
                CreatedAt = DateTime.UtcNow
            };

            // 3. تشفير الباسورد
            newUser.HashPassWord = new PasswordHasher<User>().HashPassword(newUser, request.Password);

            // 4. حفظ المستخدم في قاعدة البيانات مباشرة بدون شروط أدوار
            context.users.Add(newUser);
            await context.SaveChangesAsync();

            return new UserResponseDto
            {
                Username = newUser.Name,
                CreatedAt = newUser.CreatedAt
            };
        }

        public async Task<ResponseToken> login(loginRequestDto request)
        {
            // البحث عن المستخدم باستخدام الـ Name الموجود في الـ Request
            var user = await context.users.FirstOrDefaultAsync(p => p.Name == request.Name);
            
            if (user is null)
            {
                throw new NotFoundException("User not found.");
            }

            // التحقق من صحة كلمة المرور
            var pass = new PasswordHasher<User>().VerifyHashedPassword(user, user.HashPassWord, request.Password);
            if (pass == PasswordVerificationResult.Failed)
            {
                throw new UnauthorizedException("Invalid credentials.");
            }

            return await CreateTokenAsync(user);
        }

        private async Task<ResponseToken> CreateTokenAsync(User user)
        {
            return new ResponseToken
            {
                AccessToken = await GenerateAccessTokenAsync(user),
                RefreshToken = await GenerateAndSaveRefreshTokenAsync(user)
            };
        }

        private Task<string> GenerateAccessTokenAsync(User user)
        {
            // وضع الـ Claims الأساسية بدون Role
            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, user.id.ToString()),
                new Claim(ClaimTypes.Name, user.Name)
            };

            var key = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(configuration["AppSettings:SecretKey"]!)
            );

            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var token = new JwtSecurityToken(
                issuer: configuration.GetValue<string>("AppSettings:Issuer"),
                audience: configuration.GetValue<string>("AppSettings:Audience"),
                claims: claims,
                expires: DateTime.UtcNow.AddHours(2),
                signingCredentials: creds
            );

            return Task.FromResult(new JwtSecurityTokenHandler().WriteToken(token));
        }

        private static string GenerateToken()
        {
            var randomNumber = new byte[32];
            using var rng = RandomNumberGenerator.Create();
            rng.GetBytes(randomNumber);
            return Convert.ToBase64String(randomNumber);
        }

        private async Task<string> GenerateAndSaveRefreshTokenAsync(User user)
        {
            var refreshToken = GenerateToken();
            user.RefreshToken = refreshToken;
            user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(7);

            await context.SaveChangesAsync();
            return refreshToken;
        }

        public async Task<ResponseToken?> RefreshTokenAsync(string refreshToken)
        {
            var user = await context.users.FirstOrDefaultAsync(u => u.RefreshToken == refreshToken);

            if (user is null || user.RefreshTokenExpiryTime <= DateTime.UtcNow)
            {
                throw new UnauthorizedException("Invalid or expired refresh token.");
            }

            return await CreateTokenAsync(user);
        }
    }
}