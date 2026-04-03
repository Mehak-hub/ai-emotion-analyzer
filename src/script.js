// Questions
const questions = [
"Tell me about yourself",
"Why do you want this job?",
"What are your strengths?",
"What are your weaknesses?",
"Where do you see yourself in 5 years?"
];

let questionIndex = 0;

// Ask question
function askQuestion() {
document.getElementById("question").innerText = questions[questionIndex];

questionIndex++;

if(questionIndex >= questions.length){
questionIndex = 0;
}
}


// Start webcam
const video = document.getElementById("video");

navigator.mediaDevices.getUserMedia({ video: true, audio: true })
.then(function(stream){
video.srcObject = stream;
})
.catch(function(err){
console.log("Camera error:", err);
});


// Speech recognition
let recognition;

function startAnswer(){

recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();

recognition.lang = "en-US";
recognition.start();

recognition.onresult = function(event){

let transcript = event.results[0][0].transcript;

document.getElementById("answer").innerText = "You said: " + transcript;

analyzeEmotion(transcript);

}

}


// Fake emotion analyzer (simple demo)
function analyzeEmotion(text){

let emotion = "Neutral";

if(text.includes("confident") || text.includes("strong")){
emotion = "Confident";
}

if(text.includes("sorry") || text.includes("weak")){
emotion = "Nervous";
}

if(text.includes("excited")){
emotion = "Happy";
}

document.getElementById("emotion").innerText = emotion;

}