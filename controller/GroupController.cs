
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SignalRChat.Services;
using System.Security.Claims;

namespace SignalRChat.Controllers
{
    [ApiController]
    [Route("api/groups")]
    [Authorize]
    public class GroupsController : ControllerBase
    {
        private readonly IAddGroup _groupService;

        public GroupsController(IAddGroup groupService)
        {
            _groupService = groupService;
        }

        private bool TryGetUserId(out int userId)
        {
            var userIdClaim =
                User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

            return int.TryParse(userIdClaim, out userId);
        }

        // GET: /api/groups
        // Returns the groups belonging to the logged-in user.
        [HttpGet]
        public async Task<IActionResult> GetGroups()
        {
            if (!TryGetUserId(out var userId))
                return Unauthorized();

            var groups = await _groupService.GetGroups(userId);

            return Ok(groups);
        }

        // POST: /api/groups
        // Body: { "groupName": "family" }
        [HttpPost]
        public async Task<IActionResult> CreateGroup(
            [FromBody] CreateGroupDto dto)
        {
            if (!TryGetUserId(out var userId))
                return Unauthorized();

            if (dto == null || string.IsNullOrWhiteSpace(dto.GroupName))
                return BadRequest(new
                {
                    message = "Group name is required."
                });

            var groupName = dto.GroupName.Trim();

            if (groupName.Length > 60)
                return BadRequest(new
                {
                    message = "Group name cannot exceed 60 characters."
                });

            var result = await _groupService.AddNewGroup(
                groupName,
                userId
            );

            return Ok(result);
        }

        // DELETE: /api/groups/{groupName}
        [HttpDelete("{groupName}")]
        public async Task<IActionResult> DeleteGroup(string groupName)
        {
            if (!TryGetUserId(out var userId))
                return Unauthorized();

            if (string.IsNullOrWhiteSpace(groupName))
                return BadRequest(new
                {
                    message = "Group name is required."
                });

            await _groupService.DeleteGroup(groupName, userId);

            return NoContent();
        }
    }

    public class CreateGroupDto
    {
        public string GroupName { get; set; } = string.Empty;
    }
}
