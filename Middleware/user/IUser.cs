
using SignalRChat.Dtos.UserDto;
using SignalRChat.Dtos.Token;

namespace SignalRChat.Services
{
    public interface IUser
    {
       public Task<UserResponseDto> register (CreateUserRequestDto request) ; 
       public Task<ResponseToken> login (loginRequestDto request) ; 
       Task<ResponseToken?> RefreshTokenAsync(string refreshToken);
    }
}