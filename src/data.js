import snapshot from './data/monza-2024.json' with {type:'json'};
import {buildModel} from './model.js';
export const {race,drivers,results,laps,safetyPeriods,cleanLaps,metric,formatPace,gapLabel,finishLabel,compoundNames,byId,moments,insights}=buildModel(snapshot);
