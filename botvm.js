const { Client, MessageEmbed } = require('discord.js');
const bot = new Client();
let config = require('./botconfig.json'); 
let token = config.token; 
let prefix = config.prefix;
var fs = require("fs");

bot.on('ready', () => { 
	let currentdate = new Date();
	console.log(currentdate.getHours() + ":" + currentdate.getMinutes() + ":" + currentdate.getSeconds() + " "
				+ currentdate.getDate() + "." + (currentdate.getMonth() + 1)  + "." + currentdate.getFullYear());
    console.log(`Запустился бот ${bot.user.username}`);
    bot.generateInvite(["ADMINISTRATOR"]).then(link => { 
        console.log(link);
	let act = "my Lord Dyed-Eye";
	bot.user.setActivity(act, { type: 'LISTENING' })
		.then(presence => console.log(`Activity set to ${presence.activities[0].name}`))
		.catch(console.error);
    });
});
bot.on('disconnect', function() {
	console.log('${bot.user.username} disconnected');
	bot.connect(); //Auto reconnect
});
bot.on('message', message => {
  if (message.channel.type == "dm") return;
  let messageText = message.content;
  let messageWords = messageText.trim().split(" ");
  if (!message.content.startsWith(prefix)) return;
  if (message.author.bot) return;
  let v = JSON.parse(fs.readFileSync("voices.json"));
  if (messageWords[0] === prefix + 'setup' && (message.member.hasPermission("ADMINISTRATOR") || message.member.id == '478621188860411904')){
	  message.delete();
	  setup(message, v);
  }
});
bot.on('voiceStateUpdate', (oldState, newState) => {
	let v = JSON.parse(fs.readFileSync("voices.json"));
	let oldcatid;
	let oldmaster;
	for (let sidI in v.servers){
		if (v.servers[sidI].sid == oldState.guild.id){
			oldcatid = v.servers[sidI].catid;
			oldmaster = v.servers[sidI].master;
		}
	}
	let newcatid;
	let newmaster;
	let sidNum = -1;
	for (let sidI in v.servers){
		if (v.servers[sidI].sid == newState.guild.id){
			newcatid = v.servers[sidI].catid;
			newmaster = v.servers[sidI].master;
			sidNum = sidI;
		}
	}
	if (newState.channelID == newmaster && newState.channelID){ //newState exist && mem just connected to the master
		for (let uidI in v.servers[sidNum].muted){
			if (v.servers[sidNum].muted[uidI].uid == newState.member.id){
				v.servers[sidNum].muted.splice(uidI, 1);
				unmute(newState.member);
			}
		}
		for (let uidI in v.servers[sidNum].deafened){
			if (v.servers[sidNum].deafened[uidI].uid == newState.member.id){
				v.servers[sidNum].deafened.splice(uidI, 1);
				undeafen(newState.member);
			}
		}
		moveTo(newState, newcatid);
	} else {
		if (oldState.channel) {
			if (oldState.channel.parent.id == oldcatid && oldState.channelID != oldmaster){ //mem was in privare category, but not in the master
				if (newState.channelID != oldState.channelID){ //mem joined to another channel or left
					if (oldState.channel.members.array().length == 0){
						if (!oldState.channel.deleted) oldState.channel.delete().catch(console.error);
					}
				} else { //mem's channel didn't change
					if (!oldState.serverMute && newState.serverMute){ //mem has been muted
						let um = false;
						for (let uidI in v.servers[sidNum].muted){
							if (v.servers[sidNum].muted[uidI].uid == newState.member.id){
								um = true;
							}
						}
						if (!um){
							v.servers[sidNum].muted.push({"uid": newState.member.id});
						}
					}
					if (!oldState.serverDeaf && newState.serverDeaf){ //mem has been deafened
						let ud = false;
						for (let uidI in v.servers[sidNum].deafened){
							if (v.servers[sidNum].deafened[uidI].uid == newState.member.id){
								ud = true;
							}
						}
						if (!ud){
							v.servers[sidNum].deafened.push({"uid": newState.member.id});
						}
					}
				}
			}
		} else {
			if (sidNum != -1){ //new server has set up the private category
				for (let uidI in v.servers[sidNum].muted){
					if (v.servers[sidNum].muted[uidI].uid == newState.member.id){
						v.servers[sidNum].muted.splice(uidI, 1);
						if (newState.serverMute){ //the muted list is being edited only when someone has been muted so bot checks if he is muted at the moment
							unmute(newState.member);
						}
					}
				}
				for (let uidI in v.servers[sidNum].deafened){
					if (v.servers[sidNum].deafened[uidI].uid == newState.member.id){
						v.servers[sidNum].deafened.splice(uidI, 1);
						if (newState.serverDeaf){
							undeafen(newState.member);
						}
					}
				}
			}
		}
	}
	fs.writeFileSync("voices.json", JSON.stringify(v, null, 1));
});

async function unmute(m){
	m.edit({mute: false});
	console.log(m.displayName + " has been unmuted!");
}
async function undeafen(m){
	m.edit({deaf: false});
	console.log(m.displayName + " has been undeafened!");
}
async function moveTo(state, catid){
	let cat = await state.guild.channels.cache.find(ch => ch.id == catid);
	let ch = await state.guild.channels.create(state.member.displayName, {type: "voice",
																		  parent: cat});
	ch.createOverwrite(state.member, {
		'MUTE_MEMBERS': true,
		'DEAFEN_MEMBERS': true,
		'MOVE_MEMBERS': true,
		'MANAGE_CHANNELS': true,
		'STREAM': true,
		'VIEW_CHANNEL': true,
		'CONNECT': true,
		'SPEAK': true,
		'USE_VAD': true
	})
	state.member.edit({channel: ch});
}
async function setup(message, v){
	let cat = await message.guild.channels.create("Private Voice Channels", {type: "category"});
	let master = await message.guild.channels.create("master", {type: "voice",
																parent: cat});
	let sExist = false;
	for (let sidI in v.servers){
		if (v.servers[sidI].sid == message.guild.id){
			sExist = true;
			v.servers[sidI].catid = cat.id;
			v.servers[sidI].master = master.id;
		}
	}
	if (!sExist) {
		let newServer = {
			 "sid": message.guild.id,
			 "catid": cat.id,
			 "master": master.id,
			 "muted": [],
			 "deafened": []
		}
		v.servers.push(newServer);
	}
	fs.writeFileSync("voices.json", JSON.stringify(v, null, 1));
	const embed = new MessageEmbed()
		.setColor(0x66ff99)
		.setDescription("Private voice category has successfully set up");
	message.channel.send(embed);
}

bot.login(token);