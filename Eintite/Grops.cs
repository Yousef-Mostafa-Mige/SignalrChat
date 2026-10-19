namespace SignalRChat.Entities
{
    public class Groups
    {
        public int id { get; set; }
        public string NameGroup { get; set; } = string.Empty;
        public int UserId { get; set; }
        public User User { get; set; } = null!; 
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    }
}