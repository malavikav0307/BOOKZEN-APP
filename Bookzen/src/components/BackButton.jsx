import "./BackButton.css";

function BackButton({ setPage, previousPage = "home", goBack }) {
  const handleClick = () => {
    if (typeof goBack === "function") {
      goBack(previousPage);
    } else if (typeof setPage === "function") {
      setPage(previousPage);
    }
  };

  return (
    <button
      type="button"
      className="back-button"
      onClick={handleClick}
      title="Go Back"
    >
      ←
    </button>
  );
}

export default BackButton;