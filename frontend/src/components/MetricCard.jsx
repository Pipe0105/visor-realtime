import React from "react";

export default function MetricCard({ title, value, color = "text-primary", icon = ""}) {
    return (
        <div 
          className="flex-1 bg-card dark:bg-darkCard rounded-2xl shadow-md p-6 transition-all duration-300 hover:shadow-lg animate-pop">
            <div className="flex items-center justify-between" >
                <h3 className={`text-lg font-semibold ${color}`}> {title} </h3>
                <span className="text-2x1 opacity-80" > {icon} </span>
            </div>
            <p className="text-3x1 font-bold text-gray-900 dark:text-darkText mt-3" >
                {value}
            </p>
          </div>
    );
}