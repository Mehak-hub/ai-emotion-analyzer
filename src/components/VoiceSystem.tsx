import { useState } from "react";

function VoiceSystem(){

const questions = [
"Tell me about yourself",
"Why do you want this job",
"What are your strengths",
"What are your weaknesses",
"Where do you see yourself in five years",
"Why should we hire you"
];

const [index,setIndex] = useState(0);
const [currentQuestion,setCurrentQuestion] = useState("");
const [listening,setListening] = useState(false);

const askQuestion = () => {

if(index < questions.length){

const q = questions[index];

setCurrentQuestion(q);

const speech = new SpeechSynthesisUtterance(q);

window.speechSynthesis.speak(speech);

setIndex(index+1);

}

};

const startMic = () => {
setListening(true);
};

return(

<div style={{marginTop:"40px", textAlign:"center"}}>

<h2>Question: {currentQuestion}</h2>

<button
onClick={askQuestion}
style={{
padding:"10px 20px",
fontSize:"16px",
background:"#4facfe",
color:"white",
border:"none",
borderRadius:"8px",
cursor:"pointer",
marginRight:"10px"
}}
>

Next Question

</button>

<button
onClick={startMic}
style={{
padding:"10px 20px",
fontSize:"16px",
background:"#28a745",
color:"white",
border:"none",
borderRadius:"8px",
cursor:"pointer"
}}
>

🎤 Start Mic

</button>

{listening && (

<div className="mic-container">

<div className="mic-icon">🎤</div>

<div className="voice-bars">

<span></span>
<span></span>
<span></span>
<span></span>
<span></span>

</div>

</div>

)}

</div>

);

}

export default VoiceSystem;