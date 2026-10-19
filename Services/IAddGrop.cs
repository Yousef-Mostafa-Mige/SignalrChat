using signalRChat.Dtos.GroupDto;

namespace SignalRChat.Services
{
    public interface IAddGroup
    {
        Task<List<string>> GetGroups(int userId);
        Task<ResponseGroupDto> AddNewGroup(string groupName, int userId);
        Task DeleteGroup(string groupName, int userId);
    }
}