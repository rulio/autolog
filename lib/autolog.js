#! /usr/bin/env node
/*
 * autolog
 * https://github.com/rulio/autolog
 *
 * Copyright (c) 2014 Raul Reynoso
 * Licensed under the MIT license.
 */

'use strict';

console.log(process.argv);

var exec = require('child_process').exec,
    child,
    done = function(){
        console.log('done');
    }; // Tells Grunt that an async task is complete

var getStoryId = function(row){
    var msg,matches;
    msg=row[4];
    matches = msg.match(/\[#([0-9]+)\]/);
    if(matches===null){
        return null;
    }
    else {
        return matches[1];
    }
};
var makeArray = function(changelog){
    var i, row,line,storyId;

    changelog = changelog.split("\n");
    for (i = 0;i<changelog.length;i++){
        line=changelog[i];
        row = line.split('*\t-');
        changelog[i]=row;
        storyId = getStoryId(row);
        row[row.length]=storyId;

    }
    return changelog;
};
var _getStory=function(storyAr,storyId){
    var i,story;
    for(i = 0; i < storyAr.length; i++) {
        story =storyAr[i];
        if (story.storyId == storyId) {
            return story
        }
    }
    return null;
};
var _containsStory=function(storyAr,storyId){
    return _getStory(storyAr,storyId) === null;
};
var groupByStoryId=function(changelog){
    var i,storyId,commit,index,stories=[],story;
    for (i = 0;i<changelog.length;i++){
        commit = changelog[i];
        storyId = commit[5];
        if (storyId ==null){
            storyId = 'none';
        }
        if (_containsStory(stories,storyId)){
            stories[stories.length]={storyId:storyId,commits:[commit]};
        }
        else{
            story = _getStory(stories,storyId);
            story.commits[story.commits.length]=commit;
        }
    };
    stories.sort(function(a,b){
        if( a.storyId > b.storyId && a.storyId != 'none'){
            return -1;
        }
        if(a.storyId < b.storyId || a.storyId =='none'){
            return 1;
        }
        return 0
    });
    return stories;
};
var _getStoryTitles = function(stories){
    var request = require('request');
    var returned = 0;
    var story;
    var options = {};
    for(var i=0;i<stories.length;i++){
        options={
            url:settings.pivotalApiBase+"/projects/"+settings.pivotalProject+"/stories/"+stories[i].storyId,
            headers:{
                'X-TrackerToken':settings.pivotalToken
            }
        };
        //console.log(options);

        child=request(options, function (error, response, body) {
            //console.log(response);
            returned++;
            if (!error && response.statusCode == 200) {
                var obj=JSON.parse(body);
                //console.log(obj.id);
                story = _getStory(stories,obj.id);
                if(story!==null){
                    story.name=obj.name;
                }
                //story.name=obj.name;
               //te console.log(obj.name);
            }

            if(returned>=stories.length){
                //console.log(stories);
                outputMarkdown(stories)
                done(error);
            }
        })
    }
    story = _getStory(stories,'none');
    story.name=settings.defaultStoryTitle;
};
var _getStoryMarkdown=function(story){
    var commit,shortHash,hash,author,date,message;
    var markdown = "\n### " +story.name;
    if(story.storyId !=='none'){
        markdown +=  " [View Story](https://www.pivotaltracker.com/n/projects/"+settings.pivotalProject+"/stories/"+story.storyId+" '"+story.name+"')";
    }
    markdown +="\n";
    for(var i=0;i<story.commits.length;i++){
        commit=story.commits[i];
        shortHash=commit[0];
        hash=commit[1];
        author=commit[2];
        date=new Date(commit[3]);
        message=commit[4].replace("[#"+story.storyId+"]","");
        markdown += "["+shortHash+"]("+settings.repoBaseUrl+"/commits/"+hash+" '"+hash+"') "
            + message+"\n \n"
            +"_"+author+"_ "
            +""+ date.toLocaleDateString() + " " + date.toLocaleTimeString()+""
            +"\n\n---\n   "
    }
    return markdown+"\n";

};
var outputMarkdown=function(stories){
    var markdown = "",story;
    console.log(stories.length);
    for(var i=0;i<stories.length;i++){
        story=stories[i];
        markdown += _getStoryMarkdown(story);
    }
    console.log(markdown);
};
var fs = require('fs');

if (fs.existsSync('.autolog.js')) {
    console.log('found .autolog.js');
    var settings = require('../.autolog.js').getSettings();
}
else{
    console.log(false);
}
child =exec('git log  --pretty=format:\'%h*%x09-%H*%x09-%an*%x09-%ad*%x09-%s\' 2.0.0..2.0.1.2 ',function(error,changelog,stderr){
    changelog = makeArray(changelog);
    var stories = groupByStoryId(changelog);
    _getStoryTitles(stories);

    //grunt.log.writeln('stderr: ' + stderr);
    //done(error); // Technique recommended on #grunt IRC channel. Tell Grunt asych function is finished. Pass error for logging; if operation completes successfully error will be null
});