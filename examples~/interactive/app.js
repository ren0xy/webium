// Counter
var count = 0;
var incrementBtn = document.getElementById("increment");

incrementBtn.addEventListener("click", function() {
  count++;
  incrementBtn.textContent = "Count: " + count;
});

// Text input echo
var textInput = document.getElementById("text-input");
var echo = document.getElementById("echo");

textInput.addEventListener("input", function() {
  echo.textContent = textInput.value;
});

// Dynamic list
var itemCount = 0;
var addBtn = document.getElementById("add-item");
var removeBtn = document.getElementById("remove-item");
var itemList = document.getElementById("item-list");

addBtn.addEventListener("click", function() {
  itemCount++;
  var li = document.createElement("li");
  li.textContent = "Item " + itemCount;
  itemList.appendChild(li);
});

removeBtn.addEventListener("click", function() {
  if (itemList.lastChild) {
    itemList.removeChild(itemList.lastChild);
  }
});
