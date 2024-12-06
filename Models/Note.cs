public class Note
{
  public int Id { get; set; }
  public string Title { get; set; }
  public string Text { get; set; }
  public string ImagePath { get; set; }
  public DateTime Date { get; set; }
  public bool IsDeleted { get; set; }
  public int UserId { get; set; } 
  public User User { get; set; } 
  public string ShareToken { get; set; }

  public bool IsFolder { get; set; }
  public int? ParentId { get; set; }
  public Note Parent { get; set; }
  public List<Note> Children { get; set; }
}

