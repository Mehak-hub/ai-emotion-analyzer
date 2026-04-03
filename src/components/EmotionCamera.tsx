import { useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";

function EmotionCamera() {

const videoRef = useRef<HTMLVideoElement>(null);

const [emotion,setEmotion] = useState("Detecting...");
const [confidence,setConfidence] = useState(0);
const [eyeContact,setEyeContact] = useState("Checking...");
const [finalResult,setFinalResult] = useState("Evaluating...");
const [interviewFinished,setInterviewFinished] = useState(false);

useEffect(()=>{
startVideo();
loadModels();
},[])

const startVideo = () => {
navigator.mediaDevices.getUserMedia({video:true})
.then((stream)=>{
if(videoRef.current){
videoRef.current.srcObject = stream;
}
})
}

const loadModels = async () => {

const MODEL_URL="/models";

await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);

detectEmotion();

}

const detectEmotion = () => {

setInterval(async()=>{

if(interviewFinished) return;

if(videoRef.current){

const detections = await faceapi
.detectAllFaces(
videoRef.current,
new faceapi.TinyFaceDetectorOptions({ inputSize: 224 })
)
.withFaceExpressions();

if(detections.length>0){

const expressions = detections[0].expressions;

const maxEmotion = Object.keys(expressions).reduce((a,b)=>
expressions[a] > expressions[b] ? a : b
);

setEmotion(maxEmotion);

let score = 50;

if(maxEmotion === "happy") score = 90;
else if(maxEmotion === "neutral") score = 75;
else if(maxEmotion === "surprised") score = 70;
else if(maxEmotion === "sad") score = 40;
else if(maxEmotion === "angry") score = 30;
else if(maxEmotion === "fearful") score = 35;

setConfidence(score);

const box = detections[0].detection.box;
const videoWidth = videoRef.current.videoWidth;

const center = box.x + box.width/2;

let eyeStatus = "Poor Eye Contact";

if(center > videoWidth*0.35 && center < videoWidth*0.65){
eyeStatus = "Good Eye Contact";
}

setEyeContact(eyeStatus);

let result = "Needs Improvement";

if(score >= 70 && eyeStatus === "Good Eye Contact"){
result = "Highly Recommended";
}
else if(score >= 60){
result = "Recommended";
}
else{
result = "Not Recommended";
}

setFinalResult(result);


}

}

},300);

}

return(

<div style={{textAlign:"center", marginTop:"20px"}}>

<video
ref={videoRef}
autoPlay
muted
style={{
width:"700px",
borderRadius:"12px",
marginTop:"20px"
}}
/>

<h3>Emotion Detected: {emotion}</h3>
<h3>Confidence Score: {confidence}%</h3>
<h3>Eye Contact: {eyeContact}</h3>

{interviewFinished && (
<h2>Final Result: {finalResult}</h2>
)}

<button
onClick={()=>setInterviewFinished(true)}
style={{
marginTop:"20px",
padding:"10px 20px",
fontSize:"16px",
background:"#ff4d4d",
color:"white",
border:"none",
borderRadius:"8px",
cursor:"pointer"
}}
>

Finish Interview

</button>

</div>

)

}

export default EmotionCamera;