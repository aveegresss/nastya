using System.Text.Json;
public class UsersService
{
  private readonly ApplicationDbContext _context;

  public UsersService(ApplicationDbContext context)
  {
    _context = context;
  }

  public User GetUserByAuthToken(string authToken)
  {
    return _context.Users.FirstOrDefault(u => u.AuthToken == authToken);
  }

  public string RegisterUser(JsonElement json)
  {
    var username = json.GetProperty("username").GetString();
    var passwordHash = json.GetProperty("password_hash").GetString();

    if (_context.Users.Any(u => u.Username == username))
      return JsonSerializer.Serialize(new { action = "register", status = "error", message = "User already exists" });

    var user = new User
    {
      Username = username,
      PasswordHash = passwordHash,
      AuthToken = Guid.NewGuid().ToString()
    };

    _context.Users.Add(user);
    _context.SaveChanges();

    return JsonSerializer.Serialize(new { action = "register", status = "success", auth_token = user.AuthToken });
  }

  public string LoginUser(JsonElement json)
  {
    var username = json.GetProperty("username").GetString();
    var passwordHash = json.GetProperty("password_hash").GetString();

    var user = _context.Users.SingleOrDefault(u => u.Username == username && u.PasswordHash == passwordHash);

    if (user == null)
      return JsonSerializer.Serialize(new { action = "login", status = "error", message = "Invalid credentials" });

    return JsonSerializer.Serialize(new { action = "login", status = "success", auth_token = user.AuthToken });
  }
}