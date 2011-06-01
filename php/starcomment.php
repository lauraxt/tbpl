<?php

// some globals
$elastic_search_server = "http://elasticsearch1.metrics.sjc1.mozilla.com:9200/";

// ElasticSearch's 'index' and 'doctype' are roughly similar to the SQL
// concepts of 'database' and 'table'.  We store all TBPL comments verbatim
// in the 'comments' doctype of the 'tbpl' index.  We additionally store
// unique instances of bug-per-failure in the bugs/bug_info, for use by
// OrangeFactor.
$elastic_search_comment_index = "tbpl";
$elastic_search_comment_doctype = "comments";
$elastic_search_bug_index = "bugs";
$elastic_search_bug_doctype = "bug_info";

$log_filename = "esinput.log";
$log_fp = null;

error_reporting(E_ERROR | E_PARSE);

function log_msg($msg)
{
  global $log_fp;

  if ($log_fp)
    fwrite($log_fp, $msg);
}

// make a simple HTTP request and return the response
function do_http_request($url, $data, $method = 'POST')
{
  try {

    $params = array('http' => array(
                'method' => $method,
                'content' => json_encode($data),
                'header' => "Content-type: text/plain\r\n" .
                            "Connection: close\r\n"
              ));

    $ctx = stream_context_create($params);
    $fp = fopen($url, 'rb', false, $ctx);

    $response = stream_get_contents($fp);
    if ($response === false) {
      log_msg("Problem reading data from $url\n");
    }
    if ($fp) {
      fclose($fp);
    }
    return $response;

 } catch(Exception $e) {
   log_msg("Network error: " . $e->getMessage() . "\n");
 }

}

function get_notes($url, $params)
{
  log_msg(json_encode($params) . "\n");

  // create a request
  $request = array('query' => array(
                    'bool' => array(
                      'must' => array(
                        array('field' => array('tree' => $params['tree'])),
                        array('field' => array('date' => implode(" ", $params['dates'])))
                        )
                      )
                    ),
                    'size' => 5000
                  );

  $notes = array();

  try {
    // send the request to the _search url with HTTP GET
    $result = do_http_request($url . "_search", $request, 'GET');
    $result = json_decode($result);

    if (!(property_exists($result, 'hits') && property_exists($result->hits, 'hits'))) {
      $notes = array('error' => 'invalid ElasticSearch response');      
    }

    $hits = $result->hits->hits;

    foreach($hits as $hit) {
      $note = array('startTime' => $hit->_source->starttime,
                    'slave' => $hit->_source->machinename,
                    'who'=> $hit->_source->who,
                    'note'=> $hit->_source->comment);
      if (property_exists($hit->_source, 'timestamp')) {
        $note['timestamp'] = $hit->_source->timestamp;
      }
      array_push($notes, $note);
    }
  } catch(Exception $e) {
    $notes = array('error' => $e->getMessage());
  }

  header("Content-Type: text/plain,charset=utf-8");
  header("Access-Control-Allow-Origin: *");
  header("Cache-control: no-cache");
  echo json_encode($notes);
}

// send a bug to ES if it doesn't already exist there
function send_bug($url, $dat, $bug)
{
  unset($dat['comment']);
  $dat['bug'] = $bug;

  // create a request body to test if this bug is already in ES
  $request = array('query' => array(
                    'bool' => array(
                      'must' => array(
                        array('field' => array('bug' => $bug)),
                        array('field' => array('machinename' => $dat['machinename'])),
                        array('field' => array('starttime' => $dat['starttime']))
                        )
                      )
                    )
                  );
  log_msg("request: " . json_encode($request) . "\n");

  // send the request to the _search url with HTTP GET
  $result = do_http_request($url . "_search", $request, 'GET');
  log_msg("response: " . $result . "\n");

  // find how many instances of this bug already exist in ES
  $hits = json_decode($result)->hits->total;
  log_msg("hits: " . json_encode($hits) . "\n");

  // if no instances exist, add to ES
  if ($hits == 0) {
    log_msg("writing bug to ES: " . json_encode($dat) . "\n");
    $result = do_http_request($url, $dat);
    log_msg("result: " . $result . "\n");
  }
}

$es_comment_url = $elastic_search_server . $elastic_search_comment_index .
                  "/" . $elastic_search_comment_doctype . "/";
$es_bug_url = $elastic_search_server . $elastic_search_bug_index .
              "/" . $elastic_search_bug_doctype . "/";

if ($log_filename)
  $log_fp = fopen($log_filename, 'a');

if (isset($_GET['dates'])) {

  get_notes($es_comment_url, $_GET);

} else {
  try {

    // the comment arrives as the data in the $_POST array
    $dat = $_POST;

    // send the comment to ES, as-is
    log_msg("writing comment to ES: " . json_encode($dat) . "\n");
    log_msg("response: " . do_http_request($es_comment_url, $dat) . "\n");

    // search the comment string and see if any bug numbers are referenced
    $hits = preg_match_all('/Bug\s*(?P<bug>\d+)/i', $dat['comment'], $matches);

    // for each bug referenced, push the bug data to the 'bugs' doctype separately
    if ($hits) {
      foreach ($matches['bug'] as $bug) {
        log_msg("bug found: " . $bug . "\n");
        send_bug($es_bug_url, $dat, $bug);
      }
    }
    else {
      log_msg("no bug found\n");
    }

  }
  catch (Exception $e) {
    echo 'Caught exception: ',  $e->getMessage(), "\n";
    log_msg('Caught exception: ' . $e->getMessage() . "\n");
  }
}

if ($log_fp)
  fclose($log_fp);

