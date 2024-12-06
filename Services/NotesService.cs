using Microsoft.AspNetCore.Mvc;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
public class NotesService
{
  private readonly ApplicationDbContext _context;
  private readonly UsersService _usersService;
  private readonly CipherService _cipherService;

  public NotesService(ApplicationDbContext context, UsersService usersService)
  {
    _context = context;
    _usersService = usersService;
    _cipherService = new CipherService();
  }

  public string CreateNote(JsonElement json)
  {
    var user = _usersService.GetUserByAuthToken(json.GetProperty("auth_token").GetString());

    if (user == null)
      return JsonSerializer.Serialize(new { action = "create_note", status = "error", message = "Invalid auth token" });

    var note = new Note
    {
      Title = _cipherService.Encrypt(json.GetProperty("title").GetString(), user.Username),
      Text = json.TryGetProperty("text", out JsonElement textElement) ? _cipherService.Encrypt(textElement.GetString(), user.Username) : null,
      Date = DateTime.Now,
      IsDeleted = false,
      UserId = user.Id,
      IsFolder = json.GetProperty("is_folder").GetBoolean(),
      ParentId = json.TryGetProperty("parent_id", out JsonElement parentId) ? parentId.GetInt32() : (int?)null,
      ShareToken = String.Empty
    };

    _context.Notes.Add(note);
    _context.SaveChanges();

    return JsonSerializer.Serialize(new { action = "create_note", status = "success", id = note.Id });
  }

  public string EditNote(JsonElement json)
  {
    var user = _usersService.GetUserByAuthToken(json.GetProperty("auth_token").GetString());
    if (user == null)
      return JsonSerializer.Serialize(new { action = "edit_note", status = "error", message = "Invalid auth token" });

    var id = json.GetProperty("id").GetInt32();
    var note = _context.Notes.FirstOrDefault(n => n.Id == id && n.UserId == user.Id);
    if (note == null)
      return JsonSerializer.Serialize(new { action = "edit_note", status = "error", message = "Note not found" });

    note.Title = _cipherService.Encrypt(json.GetProperty("title").GetString(), user.Username);
    note.Text = _cipherService.Encrypt(json.GetProperty("text").GetString(), user.Username);

    if (json.TryGetProperty("parent_id", out JsonElement parentIdElement))
    {
      note.ParentId = parentIdElement.ValueKind == JsonValueKind.Null ?
          null :
          parentIdElement.GetInt32();
    }

    _context.SaveChanges();
    return JsonSerializer.Serialize(new { action = "edit_note", status = "success" });
  }

  public string DeleteNote(JsonElement json)
  {
    var user = _usersService.GetUserByAuthToken(json.GetProperty("auth_token").GetString());

    if (user == null)
      return JsonSerializer.Serialize(new { action = "delete_note", status = "error", message = "Invalid auth token" });

    var id = json.GetProperty("id").GetInt32();
    var note = _context.Notes.FirstOrDefault(n => n.Id == id && n.UserId == user.Id);

    if (note == null)
      return JsonSerializer.Serialize(new { action = "delete_note", status = "error", message = "Note not found" });

    MarkNoteAsDeleted(note);
    _context.SaveChanges();

    return JsonSerializer.Serialize(new { action = "delete_note", status = "success" });
  }

  private void MarkNoteAsDeleted(Note note)
  {
    note.IsDeleted = true;
    var children = _context.Notes.Where(n => n.ParentId == note.Id);
    foreach (var child in children)
    {
      MarkNoteAsDeleted(child);
    }
  }

  public string GetNoteStructure(JsonElement json)
  {
    var user = _usersService.GetUserByAuthToken(json.GetProperty("auth_token").GetString());

    if (user == null)
      return JsonSerializer.Serialize(new { action = "get_note_structure", status = "error", message = "Invalid auth token" });

    var notes = _context.Notes
        .Where(n => n.UserId == user.Id && !n.IsDeleted)
        .OrderBy(n => n.IsFolder)
        .ThenBy(n => n.Title)
        .ToList();

    var structure = BuildNoteTree(notes, null, user.Username);
    return JsonSerializer.Serialize(new { action = "get_note_structure", status = "success", structure });
  }

  public string ShareNote(JsonElement json, string scheme, string host)
  {
    var user = _usersService.GetUserByAuthToken(json.GetProperty("auth_token").GetString());

    if (user == null)
      return JsonSerializer.Serialize(new { action = "share_note", status = "error", message = "Invalid auth token" });

    var noteId = json.GetProperty("id").GetInt32();
    var note = _context.Notes.FirstOrDefault(n => n.Id == noteId && n.UserId == user.Id);

    if (note == null)
      return JsonSerializer.Serialize(new { action = "share_note", status = "error", message = "Note not found" });

    if (string.IsNullOrEmpty(note.ShareToken))
    {
      note.ShareToken = GenerateShareToken();
      _context.SaveChanges();
    }

    var shareUrl = $"{scheme}://{host}/shared/{note.ShareToken}";
    return JsonSerializer.Serialize(new { action = "share_note", status = "success", shareUrl });
  }

  private string GenerateShareToken()
  {
    return Convert.ToBase64String(Guid.NewGuid().ToByteArray()).Replace("/", "_").Replace("+", "-");
  }

  private List<object> BuildNoteTree(List<Note> allNotes, int? parentId, string username)
  {
    var items = new List<object>();
    var children = allNotes.Where(n => n.ParentId == parentId).ToList();

    foreach (var child in children)
    {
      if (child.IsFolder)
      {
        items.Add(new
        {
          id = child.Id,
          title = _cipherService.Decrypt(child.Title, username),
          is_folder = true,
          children = BuildNoteTree(allNotes, child.Id, username)
        });
      }
      else
      {
        items.Add(new
        {
          id = child.Id,
          title = _cipherService.Decrypt(child.Title, username),
          is_folder = false,
          text = _cipherService.Decrypt(child.Text, username)
        });
      }
    }

    return items;
  }

  public string GetSharedNote(JsonElement json)
  {
    var token = json.GetProperty("token").GetString();

    var note = _context.Notes.FirstOrDefault(n => n.ShareToken == token && !n.IsDeleted);

    if (note == null)
    {
      Console.WriteLine("Note not found");
      return JsonSerializer.Serialize(new { action = "get_shared_note", status = "error", message = "Note not found" });
    }

    var user = _context.Users.FirstOrDefault(u => u.Id == note.UserId);

    return JsonSerializer.Serialize(new
    {
      action = "get_shared_note",
      status = "success",
      note = new
      {
        title = _cipherService.Decrypt(note.Title, user.Username),
        text = _cipherService.Decrypt(note.Text, user.Username),
        date = note.Date
      }
    });
  }
}
