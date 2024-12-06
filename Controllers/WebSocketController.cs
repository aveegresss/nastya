using Microsoft.AspNetCore.Mvc;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;

[ApiController]
[Route("ws")]
public class WebSocketController : ControllerBase
{
  private readonly NotesService _notesService;
  private readonly UsersService _usersService;

  public WebSocketController(NotesService notesService, UsersService usersService)
  {
    _notesService = notesService;
    _usersService = usersService;
  }

  [HttpGet]
  public async Task Get()
  {
    if (HttpContext.WebSockets.IsWebSocketRequest)
    {
      using var webSocket = await HttpContext.WebSockets.AcceptWebSocketAsync();
      await HandleWebSocket(webSocket);
    }
    else
    {
      HttpContext.Response.StatusCode = StatusCodes.Status400BadRequest;
    }
  }

  private async Task HandleWebSocket(WebSocket webSocket)
  {
    var buffer = new byte[1024 * 4];
    WebSocketReceiveResult result = await webSocket.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);

    while (!result.CloseStatus.HasValue)
    {
      var message = Encoding.UTF8.GetString(buffer, 0, result.Count);
      var response = ProcessMessage(message);
      var responseBytes = Encoding.UTF8.GetBytes(response);

      await webSocket.SendAsync(new ArraySegment<byte>(responseBytes), result.MessageType, result.EndOfMessage, CancellationToken.None);
      result = await webSocket.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);
    }

    await webSocket.CloseAsync(result.CloseStatus.Value, result.CloseStatusDescription, CancellationToken.None);
  }

  private string ProcessMessage(string message)
  {
    var json = JsonDocument.Parse(message).RootElement;
    var action = json.GetProperty("action").GetString();

    return action switch
    {
      "create_note" => _notesService.CreateNote(json),
      "edit_note" => _notesService.EditNote(json),
      "delete_note" => _notesService.DeleteNote(json),
      "get_note_structure" => _notesService.GetNoteStructure(json),
      "share_note" => _notesService.ShareNote(json, Request.Scheme, Request.Host.ToString()),
      "get_shared_note" => _notesService.GetSharedNote(json),
      "register" => _usersService.RegisterUser(json),
      "login" => _usersService.LoginUser(json),
      _ => JsonSerializer.Serialize(new { action = "undefined", status = "error", message = "Unknown action" })
    };
  }
}