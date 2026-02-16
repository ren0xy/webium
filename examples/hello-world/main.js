var clickCount = 0;
var button = document.getElementById("click-me");
var output = document.getElementById("output");

button.addEventListener("click", function() {
  clickCount++;
  output.textContent = "Button was clicked " + clickCount + " time(s)!";
});
