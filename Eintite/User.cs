namespace SignalRChat.Entities
{
    public class User
    {
        public int id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string HashPassWord { get; set; } = string.Empty;
        public string? RefreshToken { get; set; }
        public DateTime? RefreshTokenExpiryTime { get; set; }
        public ICollection<Groups> Groups { get; set; } = new List<Groups>();
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    }
}