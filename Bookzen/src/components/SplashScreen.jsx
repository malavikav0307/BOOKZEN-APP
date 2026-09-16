import { useEffect } from "react";

function SplashScreen({ setPage, user }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(user ? "home" : "login");
    }, 4500);

    return () => clearTimeout(timer);
  }, [user, setPage]);

return (
<div
style={{
minHeight: "100vh",
width: "100%",
background: "linear-gradient(135deg, #fff7f7, #ffdfe1)",
display: "flex",
justifyContent: "center",
alignItems: "center",
flexDirection: "column",
boxSizing: "border-box",
}}
>
<div
style={{
width: "110px",
height: "110px",
borderRadius: "50%",
background: "#fd6569",
display: "flex",
justifyContent: "center",
alignItems: "center",
fontSize: "55px",
boxShadow: "0 10px 30px rgba(253, 101, 105, 0.3)",
animation: "pulse 1.5s 3",
}}
>
📚 </div>


  <h1
    style={{
      marginTop: "25px",
      marginBottom: "5px",
      color: "#fd6569",
      fontSize: "32px",
      fontWeight: "700",
      letterSpacing: "2px",
    }}
  >
    BOOKZEN
  </h1>

  <p
    style={{
      margin: 0,
      color: "#555",
      fontSize: "15px",
    }}
  >
    Buy & Sell Books
  </p>

  <style>
    {`
      @keyframes pulse {
        0% {
          transform: scale(1);
        }

        50% {
          transform: scale(1.08);
        }

        100% {
          transform: scale(1);
        }
      }
    `}
  </style>
</div>


);
}

export default SplashScreen;
