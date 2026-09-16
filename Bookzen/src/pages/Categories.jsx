import "./Categories.css";

function Categories({ setPage, setCategory, goBack }) {
  const categories = [
  { name: "Academic", icon: "📚" },
  { name: "Novels", icon: "📖" },
  { name: "Programming", icon: "💻" },
  { name: "Competitive Exams", icon: "🏆" },
  { name: "School", icon: "🏫" },
  { name: "Kids", icon: "🧸" },
  { name: "Comics", icon: "🦸" },
  { name: "Finance & Business", icon: "💼" },
  { name: "Self-Help", icon: "🧠" },
  { name: "Romance", icon: "❤️" },
  { name: "Mystery & Thriller", icon: "🔍" },
  { name: "Science & Engineering", icon: "🔬" },
  { name: "History & Biography", icon: "📜" },
  { name: "Medical & Law", icon: "⚖️" },
  { name: "Other", icon: "📚" }
];

  const handleBack = () => {
    if (typeof goBack === "function") {
      goBack("home");
    } else {
      setPage("home");
    }
  };

  return (
    <div className="categories-page">
      {/* BACK BUTTON */}
      <button
        type="button"
        className="back-button"
        onClick={handleBack}
        title="Back"
      >
        ←
      </button>

      {/* TITLE */}
      <h1>Categories</h1>

      {/* CATEGORY CARDS */}
      <div className="category-container">
        {categories.map((item) => (
          <button
            type="button"
            className="category-card"
            key={item.name}
            onClick={() => {
              setCategory(item.name);
              setPage("categoryBooks");
            }}
          >
            <span className="category-page-icon">{item.icon}</span>
            <span className="category-page-name">{item.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default Categories;