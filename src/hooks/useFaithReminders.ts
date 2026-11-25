import { useEffect, useRef } from "react";
import { dueFaithReminders, type Goal } from "../lib/faithJourney";

export function useFaithReminders(enabled:boolean,onReminder:(goal:Goal)=>void){
  const callback=useRef(onReminder);callback.current=onReminder;
  useEffect(()=>{
    if(!enabled)return;
    let active=true;let timer=0;
    const check=async()=>{
      try{const due=await dueFaithReminders();if(active)due.forEach(callback.current)}catch(error){console.error("Faith reminder check failed",error)}
      finally{if(active)timer=window.setTimeout(check,30_000)}
    };
    void check();return()=>{active=false;window.clearTimeout(timer)};
  },[enabled]);
}
