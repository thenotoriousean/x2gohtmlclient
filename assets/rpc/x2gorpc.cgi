#!/usr/bin/perl

# Copyright © 2021 Oleksandr Shneyder <o.shneyder@phoca-gmbh.de>
#
# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published
# by the Free Software Foundation; either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program; if not, write to the
# Free Software Foundation, Inc.,
# 51 Franklin St, Fifth Floor, Boston, MA 02110-1301, USA.

use strict;
use warnings;
use CGI;

use JSON;
use Encode;
use Expect;

use File::Touch;

my $q = CGI->new;


my $action='';
my $user = '';
my $pass = '';
my $server = '';
my $proxy = '';
my $proxyuser = '';
my $proxypass = '';

my $robj={};

$action = $q->param('action');
$user = $q->param('user');
$pass = $q->param('pass');
$server = $q->param('server');
$proxy=$q->param('proxy');
$proxyuser=$q->param('proxyuser');
$proxypass=$q->param('proxypass');


my @sshparams;

if($proxy)
{
   @sshparams=('-o', 'UserKnownHostsFile=/dev/null', '-o', "ProxyCommand=ssh -W %h:%p -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no  -l $proxyuser $proxy", '-o', 'StrictHostKeyChecking=no',   '-l', "$user", "$server");
}
else
{
   @sshparams=('-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=/dev/null',  '-l', "$user", "$server");
}


print "Content-type: text/html\n\n";


if($action eq 'start')
{
    startSession();
}

if($action eq 'suspend')
{
    suspendTerminateSession(0);
}

if($action eq 'terminate')
{
    suspendTerminateSession(1);
}

sub suspendTerminateSession
{
    my $terminate=shift;
    my $sid=$q->param('sid');
    my $ssh_cmd;
    if($terminate)
    {
        $ssh_cmd="LANG= echo STDOUT_BEGIN;x2goterminate-session $sid;echo STDOUT_END 2>&1";
    }
    else
    {
        $ssh_cmd="LANG= echo STDOUT_BEGIN;x2gosuspend-session $sid;echo STDOUT_END 2>&1";
    }
    my @out=runSSHCommand($ssh_cmd); #
    parseOutput(@out[2], $robj);

    $robj={
                'status'  => @out[0],
                'last_cmd' => $ssh_cmd,
        };
    $robj->{'err'}=@out[1];
    my $jsontext =JSON->new->utf8->encode  ($robj);
    print "__STARTJSON__".$jsontext;
}

sub startSession
{
    my $cmd = '';
    my $geometry='';
    $cmd=$q->param('cmd');
    $geometry=$q->param('geometry');
    my $ssh_cmd='LANG= echo STDOUT_BEGIN;x2golistsessions;echo STDOUT_END 2>&1';
    my @out=runSSHCommand($ssh_cmd); #

    $robj={
                'status'  => @out[0],
                'last_cmd' => $ssh_cmd,
        };
    $robj->{'err'}=@out[1];
    parseOutput(@out[2], $robj);


    if( ! $robj->{'status'})
    {
        my $stout=$robj->{'stdout'};
        my @sessions=split("\n", $stout);
        my $sid='';
        my $x2gport;
        for(my $i=0;$i < @sessions;$i++)
        {
            my @details=split("\\|",$sessions[$i]);
            if ( (@details > 8) && ($details[4] eq 'S' ) && ($details [1] =~ m/_stK$cmd/))
            {
                my $sess={
                            'cookie' => $details[6],
                            'id' => $details[1],
                            'port' => $details[8],
                            'status' =>"resuming",
                        };
                $robj->{'session'} = $sess;
                $sid = $details[1];
                $x2gport=$details[8];
                goto brk;
            }
        }
        brk:
        if($sid)
        {
            $ssh_cmd="LANG= echo STDOUT_BEGIN;x2goresume-session $sid $geometry adsl 16m-jpeg-9 auto 0 none 2;echo STDOUT_END 2>&1";
        }
        else
        {
            $ssh_cmd="LANG= echo STDOUT_BEGIN;x2gostartagent $geometry adsl 16m-jpeg-9 unix-kde-depth_24 us pc105 0 K $cmd both;echo STDOUT_END 2>&1";
            $robj->{'last_cmd'}=$ssh_cmd;
            @out=runSSHCommand($ssh_cmd);
            $robj->{'status'}=@out[0];
            $robj->{'err'}=@out[1];
            parseOutput(@out[2], $robj);
            if( ! $robj->{'status'})
            {
                    my $stout=$robj->{'stdout'};
                    my @details=split("\n", $stout);
                    if(@details < 5)
                    {
                        #startagent failed
                        my $sess={
                            'id' => "",
                        };
                        $robj->{'session'} = $sess;
                        goto finish;
                    }
                    my $sess={
                            'display' => $details[1],
                            'cookie' => $details[2],
                            'pid' => $details[3],
                            'id' => $details[4],
                            'port' => $details[5],
                            'status' =>"starting",
                            };
                    $robj->{'session'} = $sess;
                    $sid = $details[4];
                    $x2gport=$details[5];
                    $ssh_cmd='LANG= echo STDOUT_BEGIN;setsid /usr/bin/x2goruncommand '.$details[1].' '.$details[3].' '.$details[4].' '.$details[5].' '.$cmd.' nosnd D 1>/dev/null & sleep 1 && cat ~/.x2go/C-'.$details[4].'/cmdoutput;echo STDOUT_END;exit';
            }
            else
            {
                    goto finish;

            }
        }

        chomp($x2gport);

        my $localport=getFreePort();
        my $wsport=getFreePort();
        $robj->{'session'}->{'wsport'}=$wsport;
        my $tunpid=openChannel($x2gport, $localport);
        wswrap($tunpid, $localport, $wsport);
        $robj->{'last_cmd'}=$ssh_cmd;

        #if new session, give agent some time to start
        if($robj->{'session'}->{'status'} eq "starting")
        {
            sleep(2);
        }

        @out=runSSHCommand($ssh_cmd);
        $robj->{'status'}=@out[0];
        $robj->{'err'}=@out[1];

        parseOutput(@out[2], $robj);
    }

    finish:
    my $jsontext =JSON->new->utf8->encode  ($robj);
    print "__STARTJSON__".$jsontext;
}


sub wswrap
{
    my $tunpid=shift;
    my $localport=shift;
    my $wsport=shift;
    if(!fork)
    {
         close(STDIN);
         close(STDOUT);
         close(STDERR);
         exec("x2gowswrapper $tunpid $localport $wsport");
    }
}

sub openChannel
{
    my $x2gport=shift;
    my $localport=shift;
    my $tunpid=fork;
    if ($tunpid)
    {
        return $tunpid;
    }
    else
    {
         runSSHCommand('x2gotun',$x2gport, $localport);
    }
}


sub simplifyOutput
{
   my $stout=shift;
   $stout=~s/\[//g;
   $stout=~s/\]//g;
   $stout=~s/\{//g;
   $stout=~s/\}//g;
   $stout=~s/\"//g;
   $stout=~s/\'//g;
   return $stout;
}


sub runSSHCommand
{
    my $command=shift;


    my @params=@sshparams;
    my $exp = new Expect;

    if($command eq 'x2gotun')
    {
        my $x2gport=shift;
        my $localport=shift;
        push @params, '-N', '-L', "$localport:localhost:$x2gport";

    }
    else
    {
         push @params, $command;
    }
    $exp->raw_pty(1);
    $exp->debug(0);
    $exp->log_user(0);
    $exp->log_stdout(0);
    $exp->exp_internal(0);



    $exp = Expect->spawn("ssh", @params);

    if($proxy)
    {
        my @retval=connectToProxy($exp);
        if( @retval[0] !=0)
        {
            return @retval;
        }
    }
    #if we have proxy, we already sent proxy pass and expecting responce
    my $val=$exp->expect(15, 'denied','assword');

    if($val == 2 )
    {
        $exp->send("$pass\n");
        my $tm=15;
        if($command eq 'x2gotun')
        {
            close(STDIN);
            close(STDOUT);
            close(STDERR);

            $tm=undef;
        }
        $val=$exp->expect($tm, 'STDOUT_END','denied');
        if($val == 1)
        {
            return (0,"",$exp->exp_before().$exp->exp_match());
        }
        elsif ( $val==2)
        {
            return (1,"Access denied on Server",$exp->exp_before().$exp->exp_match());
        }
        else
        {
            if($command eq 'x2gotun')
            {
                return (0,"",$exp->exp_before().$exp->exp_match());
            }
            return (1,"Error on Server",$exp->exp_before().$exp->exp_match());
        }
    }
    elsif ( $val==1)
    {
        return (1,"Access denied on Proxy", $exp->exp_before().$exp->exp_match());
    }
    else
    {
        return (1,"Can't connect to Server", $exp->exp_before().$exp->exp_match());
    }

    return simplifyOutput($exp->exp_before().$exp->exp_match());
}

sub connectToProxy
{
    my $exp=shift;
    my $val=$exp->expect(15, 'asswor');

    if( $val == 1)
    {
        $exp->send("$proxypass\n");
        return (0,"","");
    }
    else
    {
        return (1,"Can't connect to Proxy",$exp->exp_before().$exp->exp_match());
    }
}



sub parseOutput
{
   my $out=shift;
   $out=~s/\r//g;
   my $ref=shift;
   my @listout=split("STDOUT_BEGIN",$out);
   my $err=$listout[0];
   my $stout=$listout[1];
   $stout=(split("STDOUT_END",$stout))[0];
   $robj->{'stdout'}=simplifyOutput($stout);
   $robj->{'stderr'}=simplifyOutput($err);
}

sub getFreePort
{
    if(! -d "/tmp/x2gows")
    {
         mkdir("/tmp/x2gows");
    }
    my $ports=`ss -tln`;
    for(my $i=50000; $i< 60000; $i++)
    {
         if (index($ports, ":".$i) == -1)
         {
             if(! -e "/tmp/x2gows/$i")
             {
                 touch("/tmp/x2gows/$i");
                 return $i;
             }
         }
    }
    return 0;
}
