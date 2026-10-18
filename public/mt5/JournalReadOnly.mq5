#property strict
#property version "1.00"
#property description "Read-only journal exporter. Attach to its own chart with Allow Algo Trading OFF."
// No trading libraries, DLL imports, order submission, or remote code loading.
input string Endpoint="https://YOUR_PROJECT.supabase.co/functions/v1/mt5-sync";
input string SyncKey="";
struct Cycle {
 string key,symbol,side; long opened,closed,sequence; double remaining,volume,entryCost,exitCost,exitVolume;
 double initialSl,initialTp,finalSl,finalTp,profit,commission,swap,fee;
};
Cycle cycles[];
string acknowledged[],queue[];
string prefix,generation="";
int retrySeconds=3;
datetime nextAttempt=0,lastScan=0,lastHeartbeat=0;
bool dirty=true;
long scanFloor=0;
string Escape(string s) {StringReplace(s,"\\","\\\\");StringReplace(s,"\"","\\\"");StringReplace(s,"\r","\\r");StringReplace(s,"\n","\\n");StringReplace(s,"\t","\\t");return s;}
string Quoted(string s){return "\""+Escape(s)+"\"";}
string Num(double v){return DoubleToString(v,10);}
string LongText(long v){return StringFormat("%I64d",v);}
string Identity(){return "\"accountLogin\":"+Quoted(LongText(AccountInfoInteger(ACCOUNT_LOGIN)))+",\"server\":"+Quoted(AccountInfoString(ACCOUNT_SERVER));}
uint NameHash(string s){uint h=2166136261;for(int i=0;i<StringLen(s);i++){h^=StringGetCharacter(s,i);h*=16777619;}return h;}
void Append(string &arr[],string s){int n=ArraySize(arr);ArrayResize(arr,n+1);arr[n]=s;}
bool Contains(string &arr[],string s){for(int i=0;i<ArraySize(arr);i++)if(arr[i]==s)return true;return false;}
void Load(string name,string &arr[]){int f=FileOpen(prefix+name,FILE_READ|FILE_TXT|FILE_ANSI,0,CP_UTF8);if(f==INVALID_HANDLE)return;while(!FileIsEnding(f)){string line=FileReadString(f);if(StringLen(line)>0)Append(arr,line);}FileClose(f);}
void Save(string name,string &arr[]){int f=FileOpen(prefix+name,FILE_WRITE|FILE_TXT|FILE_ANSI,0,CP_UTF8);if(f==INVALID_HANDLE){Print("Journal: cannot persist ",name);return;}for(int i=0;i<ArraySize(arr);i++)FileWriteString(f,arr[i]+"\n");FileFlush(f);FileClose(f);}
int Post(string body,string &response){
 char data[],result[];string headers;
 int length=StringToCharArray(body,data,0,WHOLE_ARRAY,CP_UTF8);if(length>0)ArrayResize(data,length-1);
 ResetLastError();
 int code=WebRequest("POST",Endpoint,"Content-Type: application/json\r\nX-MT5-Key: "+SyncKey+"\r\n",5000,data,result,headers);
 response=CharArrayToString(result,0,WHOLE_ARRAY,CP_UTF8);
 if(code!=200)Print("Journal sync failed: HTTP ",code,". ",response," Error ",GetLastError());
 return code;
}
int FindActive(long position){string start=LongText(position)+":";for(int i=ArraySize(cycles)-1;i>=0;i--)if(StringFind(cycles[i].key,start)==0&&cycles[i].remaining>0.00000001)return i;return -1;}
int StartCycle(long position,ulong ticket,string symbol,string side,long time,long sequence,double vol,double price,double sl,double tp){
 int i=ArraySize(cycles);ArrayResize(cycles,i+1);ZeroMemory(cycles[i]);
 cycles[i].key=LongText(position)+":"+LongText((long)ticket);cycles[i].symbol=symbol;cycles[i].side=side;cycles[i].opened=time;cycles[i].sequence=sequence;
 cycles[i].remaining=vol;cycles[i].volume=vol;cycles[i].entryCost=vol*price;cycles[i].initialSl=sl;cycles[i].initialTp=tp;return i;
}
string Snapshot(Cycle &c){
 bool closed=c.remaining<0.00000001;
 return "{"+Identity()+",\"positionKey\":"+Quoted(c.key)+",\"sequence\":"+Quoted(LongText(c.sequence))+",\"sourceSymbol\":"+Quoted(c.symbol)+
 ",\"status\":"+Quoted(closed?"Closed":"Opened")+",\"side\":"+Quoted(c.side)+",\"currency\":"+Quoted(AccountInfoString(ACCOUNT_CURRENCY))+
 ",\"brokerEntryTime\":"+LongText(c.opened)+",\"brokerExitTime\":"+(closed?LongText(c.closed):"null")+
 ",\"entryPrice\":"+Num(c.entryCost/c.volume)+",\"exitPrice\":"+(closed&&c.exitVolume>0?Num(c.exitCost/c.exitVolume):"null")+
 ",\"volume\":"+Num(c.volume)+",\"initialSl\":"+Num(c.initialSl)+",\"initialTp\":"+Num(c.initialTp)+
 ",\"finalSl\":"+(closed?Num(c.finalSl):"null")+",\"finalTp\":"+(closed?Num(c.finalTp):"null")+
 ",\"grossPnl\":"+Num(c.profit)+",\"commission\":"+Num(c.commission)+",\"swap\":"+Num(c.swap)+",\"brokerFee\":"+Num(c.fee)+"}";
}
bool PositionStillOpen(string key){
 long id=StringToInteger(StringSubstr(key,0,StringFind(key,":")));
 for(int p=0;p<PositionsTotal();p++){
  if(PositionGetTicket(p)>0 && PositionGetInteger(POSITION_IDENTIFIER)==id)return true;
 }
 return false;
}
void BuildQueue(){
 if(!HistorySelect(0,TimeCurrent()+86400)){Print("Journal: history unavailable");return;}
 ArrayResize(cycles,0);
 int count=HistoryDealsTotal();
 for(int d=0;d<count;d++){
  ulong ticket=HistoryDealGetTicket(d);if(ticket==0)continue;
  long type=HistoryDealGetInteger(ticket,DEAL_TYPE);if(type!=DEAL_TYPE_BUY&&type!=DEAL_TYPE_SELL)continue;
  long pos=HistoryDealGetInteger(ticket,DEAL_POSITION_ID),entry=HistoryDealGetInteger(ticket,DEAL_ENTRY),time=HistoryDealGetInteger(ticket,DEAL_TIME),seq=HistoryDealGetInteger(ticket,DEAL_TIME_MSC);
  string symbol=HistoryDealGetString(ticket,DEAL_SYMBOL),side=type==DEAL_TYPE_BUY?"buy":"sell";
  double vol=HistoryDealGetDouble(ticket,DEAL_VOLUME),price=HistoryDealGetDouble(ticket,DEAL_PRICE),sl=HistoryDealGetDouble(ticket,DEAL_SL),tp=HistoryDealGetDouble(ticket,DEAL_TP);
  double commission=HistoryDealGetDouble(ticket,DEAL_COMMISSION),swap=HistoryDealGetDouble(ticket,DEAL_SWAP),fee=HistoryDealGetDouble(ticket,DEAL_FEE),profit=HistoryDealGetDouble(ticket,DEAL_PROFIT);
  if(vol<=0)continue;
  int i=FindActive(pos);
  if(entry==DEAL_ENTRY_IN){
   if(i<0)i=StartCycle(pos,ticket,symbol,side,time,seq,vol,price,sl,tp);
   else {cycles[i].remaining+=vol;cycles[i].volume+=vol;cycles[i].entryCost+=vol*price;}
   cycles[i].commission+=commission;cycles[i].swap+=swap;cycles[i].fee+=fee;cycles[i].profit+=profit;cycles[i].sequence=seq;
  }else if(entry==DEAL_ENTRY_OUT||entry==DEAL_ENTRY_OUT_BY||entry==DEAL_ENTRY_INOUT){
   if(i<0){Print("Journal: missing opening history for position ",pos,"; skipped.");continue;}
   double closeVol=MathMin(vol,cycles[i].remaining),fraction=closeVol/vol;
   cycles[i].remaining=MathMax(0,cycles[i].remaining-closeVol);cycles[i].exitVolume+=closeVol;cycles[i].exitCost+=closeVol*price;
   cycles[i].closed=time;cycles[i].sequence=seq;cycles[i].finalSl=sl;cycles[i].finalTp=tp;
   cycles[i].commission+=commission*fraction;cycles[i].fee+=fee*fraction;cycles[i].swap+=swap;cycles[i].profit+=profit;
   double rest=vol-closeVol;
   if(entry==DEAL_ENTRY_INOUT&&rest>0.00000001){int j=StartCycle(pos,ticket,symbol,side,time,seq,rest,price,sl,tp);cycles[j].commission=commission*(1-fraction);cycles[j].fee=fee*(1-fraction);}
  }
 }
 // Broker history reconstructs unacknowledged events after terminal restarts.
 for(int i=0;i<ArraySize(cycles);i++){if(cycles[i].remaining<0.00000001 && cycles[i].closed<scanFloor)continue;if(cycles[i].remaining>0.00000001&&!PositionStillOpen(cycles[i].key))continue;string payload=Snapshot(cycles[i]);if(!Contains(acknowledged,payload)&&!Contains(queue,payload))Append(queue,payload);}
 Save("queue.txt",queue);dirty=false;lastScan=TimeLocal();
}
int OnInit(){
 if(MQLInfoInteger(MQL_TESTER)){Print("Use a demo terminal, not Strategy Tester (WebRequest unavailable).");return INIT_FAILED;}
 if(MQLInfoInteger(MQL_TRADE_ALLOWED)){Print("SAFETY: turn OFF Allow Algo Trading for this EA only. Keep Position Sizer enabled.");return INIT_FAILED;}
 if(StringFind(Endpoint,"https://")!=0||StringLen(SyncKey)!=64){Print("Configure HTTPS Endpoint and 64-character SyncKey.");return INIT_PARAMETERS_INCORRECT;}
 prefix="JournalReadOnly_"+LongText(AccountInfoInteger(ACCOUNT_LOGIN))+"_"+IntegerToString((int)NameHash(AccountInfoString(ACCOUNT_SERVER)+Endpoint+SyncKey))+"_";
 Load("ack.txt",acknowledged);Load("queue.txt",queue);
 string state[];Load("generation.txt",state);if(ArraySize(state)>0)generation=state[0];
 EventSetTimer(3);return INIT_SUCCEEDED;
}
void OnDeinit(const int reason){EventKillTimer();Save("queue.txt",queue);}
void OnTradeTransaction(const MqlTradeTransaction &trans,const MqlTradeRequest &request,const MqlTradeResult &result){dirty=true;}
void OnTimer(){
 // Fail closed if the EA's private permission is accidentally enabled later.
 if(MQLInfoInteger(MQL_TRADE_ALLOWED)){Print("SAFETY: EA trading permission enabled; exporter stopped.");ExpertRemove();return;}
 if(!TerminalInfoInteger(TERMINAL_CONNECTED)||TimeLocal()<nextAttempt)return;
 string response;
 if(TimeLocal()-lastHeartbeat>=15){
  if(Post("{\"kind\":\"heartbeat\","+Identity()+"}",response)!=200){nextAttempt=TimeLocal()+retrySeconds;retrySeconds=MathMin(60,retrySeconds*2);return;}
  lastHeartbeat=TimeLocal();
  // Generation is an opaque UUID only, never interpreted as a command or code.
  string config[];int configCount=StringSplit(response,10,config);
  if(configCount!=2||StringLen(config[0])!=36||StringToInteger(config[1])<=0){Print("Invalid sync configuration");return;}
  scanFloor=StringToInteger(config[1]);
  if(config[0]!=generation){generation=config[0];ArrayResize(acknowledged,0);ArrayResize(queue,0);Save("ack.txt",acknowledged);Save("queue.txt",queue);string state[];Append(state,generation);Save("generation.txt",state);dirty=true;}
 }
 if(dirty||TimeLocal()-lastScan>=60)BuildQueue();
 for(int sent=0;sent<3&&ArraySize(queue)>0;sent++){
  if(Post(queue[0],response)!=200||response!="OK"){nextAttempt=TimeLocal()+retrySeconds;retrySeconds=MathMin(60,retrySeconds*2);return;}
  Append(acknowledged,queue[0]);Save("ack.txt",acknowledged);
  for(int k=1;k<ArraySize(queue);k++)queue[k-1]=queue[k];ArrayResize(queue,ArraySize(queue)-1);Save("queue.txt",queue);retrySeconds=3;
 }
}
