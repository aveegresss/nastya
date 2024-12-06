using Microsoft.EntityFrameworkCore;
public class ApplicationDbContext : DbContext
{
  public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
      : base(options)
  {
  }

  public DbSet<Note> Notes { get; set; }
  public DbSet<User> Users { get; set; }

  protected override void OnModelCreating(ModelBuilder modelBuilder)
  {
    modelBuilder.Entity<Note>()
        .HasOne(n => n.User)
        .WithMany(u => u.Notes)
        .HasForeignKey(n => n.UserId)
        .OnDelete(DeleteBehavior.Cascade);

    modelBuilder.Entity<Note>()
        .HasOne(n => n.Parent)
        .WithMany(n => n.Children)
        .HasForeignKey(n => n.ParentId)
        .OnDelete(DeleteBehavior.Restrict);

    modelBuilder.Entity<Note>()
        .Property(n => n.Title)
        .IsRequired();

    modelBuilder.Entity<User>()
        .Property(u => u.Username)
        .IsRequired();

    modelBuilder.Entity<User>()
        .Property(u => u.PasswordHash)
        .IsRequired();

    modelBuilder.Entity<Note>()
        .Property(n => n.ImagePath)
        .IsRequired(false);
  }
}