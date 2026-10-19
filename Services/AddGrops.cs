using SignalRChat.Data;
using Microsoft.EntityFrameworkCore;
using signalRChat.Dtos.GroupDto;
using SignalRChat.Entities;

namespace SignalRChat.Services
{
    public class AddGroup(AppDbContext context) : IAddGroup
    {
        public async Task<List<string>> GetGroups(int userId)
        {
            var groups = await context.groups
                .Where(g => g.UserId == userId)
                .AsNoTracking()
                .Select(g => g.NameGroup)
                .ToListAsync();
            return groups;
        }

        public async Task<ResponseGroupDto> AddNewGroup(string groupName, int userId)
        {
            var user = await context.users
                .Include(u => u.Groups)
                .FirstOrDefaultAsync(u => u.id == userId);

            if (user == null)
            {
                throw new InvalidOperationException("User not found.");
            }

            if (user.Groups.Any(group => group.NameGroup == groupName))
            {
                throw new InvalidOperationException(
                    "You already have this group.");
            }

            var newGroup = new Groups
            {
                NameGroup = groupName,
                UserId = userId,
                CreatedAt = DateTime.UtcNow
            };

            context.groups.Add(newGroup);
            await context.SaveChangesAsync();

            return new ResponseGroupDto
            {
                Name = newGroup.NameGroup
            };
        }

        public async Task DeleteGroup(string groupName, int userId)
        {
            var user = await context.users
                .Include(u => u.Groups)
                .FirstOrDefaultAsync(u => u.id == userId);

            var group = user?.Groups.FirstOrDefault(g => g.NameGroup == groupName);
            if (group != null)
            {
                user!.Groups.Remove(group);
                await context.SaveChangesAsync();
            }
        }
    }
}