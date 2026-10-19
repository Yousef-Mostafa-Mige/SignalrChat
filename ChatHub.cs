using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using SignalRChat.Services;
using System.Security.Claims;

[Authorize]
public class ChatHub(IAddGroup groupService) : Hub
{
    public async Task LeaveRoom(string roomName)
    {
        await Groups.RemoveFromGroupAsync(
            Context.ConnectionId,
            roomName
        );
    }
    public async Task JoinRoom(string groupName)
    {
        var userIdValue = Context.User?.FindFirst(
            ClaimTypes.NameIdentifier)?.Value;

        if (!int.TryParse(userIdValue, out var userId))
        {
            throw new HubException("Invalid user identity.");
        }

        var userGroups = await groupService.GetGroups(userId);

        if (!userGroups.Contains(
            groupName, StringComparer.OrdinalIgnoreCase))
        {
            throw new HubException(
                "You are not allowed to join this group.");
        }

        await Groups.AddToGroupAsync(
            Context.ConnectionId, groupName);
    }

    public async Task SendMessage(string groupName, string message)
    {
        if (string.IsNullOrWhiteSpace(message))
        {
            throw new HubException("Message cannot be empty.");
        }

        var userIdValue = Context.User?.FindFirst(
            ClaimTypes.NameIdentifier)?.Value;

        if (!int.TryParse(userIdValue, out var userId))
        {
            throw new HubException("Invalid user identity.");
        }

        var userGroups = await groupService.GetGroups(userId);

        if (!userGroups.Contains(
            groupName, StringComparer.OrdinalIgnoreCase))
        {
            throw new HubException(
                "You are not allowed to send messages to this group.");
        }

        var senderName = Context.User?.Identity?.Name ?? "User";

        await Clients.Group(groupName).SendAsync(
            "ReceiveMessage", senderName, message);
    }
}